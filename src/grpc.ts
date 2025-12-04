// backend/src/server/grpc_server.ts
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { GRPC_PORT } from "./config/env.config.js";
import logger from "./core/logger/logger.js";
import sessionCoordinator from "./modules/session/session.coordinator.js";
import { fileURLToPath } from "url";
import path from "path";

logger.debug("gRPC server module loaded and debug logging is active.");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gRPC service definition
const PROTO_PATH = path.join(process.cwd(), "src", "proto", "gnani.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const gnani_proto = grpc.loadPackageDefinition(packageDefinition).gnani as any;

// Implement gRPC service methods
const StartSession = async (
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> => {
  logger.info("StartSession received call.request:", call.request);
  logger.info("StartSession received call.metadata:", call.metadata);

  logger.debug('StartSession received call.request:', call.request);
  logger.debug('StartSession received call.metadata:', call.metadata);
  const { user_id, session_id } = call.request;
  try {
    const onTranscriptionCallback = (transcript: string, isFinal: boolean) => {
      logger.debug(
        `StartSession callback received transcript for ${user_id}: ${transcript} (isFinal: ${isFinal})`
      );
    };

    const newSessionId = await sessionCoordinator.startSession(
      user_id,
      onTranscriptionCallback,
      undefined, // onLlmChunkCallback not used for StartSession
      undefined, // onToolStatusCallback
      session_id // Pass existing session ID if provided
    );
    logger.debug(`Generated newSessionId: ${newSessionId}`);
    logger.info(
      `gRPC StartSession successful. New session ID: ${newSessionId} for user: ${user_id}`
    );

    const responseToSend = {
      success: true,
      message: "Session started",
      session_id: newSessionId,
    };
    logger.debug(
      `StartSession response to send: ${JSON.stringify(responseToSend)}`
    );
    callback(null, responseToSend);
  } catch (error: any) {
    logger.error(`Error in StartSession for user ${user_id}: ${error.message}`);
    callback({
      code: grpc.status.INTERNAL,
      details: `Failed to start session: ${error.message}`,
    });
  }
};

const SendAudioStream = (call: grpc.ServerDuplexStream<any, any>): void => {
  let currentSessionId: string | null = null;

  const setCallForSession = (
    sessionId: string,
    grpcCall: grpc.ServerDuplexStream<any, any>
  ) => {
    const waitForDrain = (stream: grpc.ServerDuplexStream<any, any>): Promise<void> => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('waitForDrain timed out after 2000ms. Proceeding anyway.');
          resolve();
        }, 2000);
        stream.once('drain', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    };

    const session = sessionCoordinator.getSession(sessionId);
    if (session) {
      session.metadata.grpcCall = grpcCall;
      session.onTranscriptionCallback = async (
        transcript: string,
        isFinal: boolean
      ) => {
        logger.debug(
          `onTranscriptionCallback triggered for session ${sessionId}. Transcript: "${transcript}", isFinal: ${isFinal}`
        );
        if (grpcCall) {
          logger.debug(`Writing to gRPC call for session ${sessionId}.`);
          let ok = true;
          if (isFinal) {
            ok = grpcCall.write({
              final_text: transcript
            });
          } else {
            ok = grpcCall.write({
              partial_text: transcript
            });
          }

          if (!ok) {
            logger.warn(`gRPC buffer full for session ${sessionId} (transcription). Waiting for drain...`);
            await waitForDrain(grpcCall);
            logger.info(`gRPC buffer drained for session ${sessionId} (transcription).`);
          }
        } else {
          logger.warn(
            `grpcCall not available for session ${sessionId} in onTranscriptionCallback.`
          );
        }
      };

      session.onLlmChunkCallback = async (chunk: any) => {
        const chunkPreview = typeof chunk === 'string'
          ? chunk.substring(0, 100)
          : JSON.stringify(chunk).substring(0, 100);

        logger.info(`[RESPONSE-FLOW-6] onLlmChunkCallback triggered`, {
          sessionId,
          chunkPreview,
          chunkType: typeof chunk,
          hasGrpcCall: !!grpcCall
        });

        if (grpcCall) {
          // Wrap in JSON structure to ensure frontend can parse it
          const payloadObj = {
            type: 'partial',
            text: typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
          };
          const payload = JSON.stringify(payloadObj);

          logger.info(`[RESPONSE-FLOW-7] Writing LLM chunk to gRPC`, {
            sessionId,
            payloadLength: payload.length,
            payloadPreview: payload.substring(0, 50)
          });

          const ok = grpcCall.write({
            llm_chunk: payload
          });

          logger.info(`[RESPONSE-FLOW-8] LLM chunk sent to frontend`, {
            sessionId,
            success: ok,
            payloadPreview: payload.substring(0, 50)
          });

          if (!ok) {
            logger.warn(`[RESPONSE-FLOW-WARN] gRPC buffer full for session ${sessionId} (LLM chunk). Waiting for drain...`);
            await waitForDrain(grpcCall);
            logger.info(`[RESPONSE-FLOW-9] gRPC buffer drained for session ${sessionId} (LLM chunk).`);
          }
        } else {
          logger.error(`[RESPONSE-FLOW-ERROR] grpcCall not available for session ${sessionId} in onLlmChunkCallback`);
        }
      };

      session.onToolStatusCallback = async (status: any) => {
        logger.debug(`onToolStatusCallback triggered for session ${sessionId}. Status: ${status.status}`);
        if (grpcCall) {
          const ok = grpcCall.write({
            tool_status: status
          });

          if (!ok) {
            logger.warn(`gRPC buffer full for session ${sessionId} (tool status). Waiting for drain...`);
            await waitForDrain(grpcCall);
            logger.info(`gRPC buffer drained for session ${sessionId} (tool status).`);
          }
        } else {
          logger.warn(`grpcCall not available for session ${sessionId} in onToolStatusCallback.`);
        }
      };
    }
  };

  call.on("data", async (chunk: any) => {
    if (!currentSessionId) {
      currentSessionId = chunk.session_id;
      if (currentSessionId) {
        const session = sessionCoordinator.getSession(currentSessionId);
        if (!session) {
          logger.warn(
            `Received audio chunk for unknown session: ${currentSessionId}. Ending stream.`
          );
          call.end(); // End the stream if session is unknown
          return;
        }
        logger.info(
          `gRPC SendAudioStream started for session: ${currentSessionId}`
        );
        setCallForSession(currentSessionId, call); // Store the call object for this session
      }
    }

    if (currentSessionId) {
      const session = sessionCoordinator.getSession(currentSessionId);
      if (!session) {
        logger.warn(
          `Session ${currentSessionId} not found during SendAudioStream. Ending stream.`
        );
        call.end();
        return;
      }

      // Handle Text Input
      if (chunk.text_input) {
        logger.info(`Received text input for session ${currentSessionId}: ${chunk.text_input}`);
        const result = await sessionCoordinator.processTextInput(currentSessionId, chunk.text_input);

        // Send the complete LLM response if available
        if (result && result.llmResponse) {
          logger.info(`Sending COMPLETE LLM response for session ${currentSessionId}`);
          call.write({
            llm_chunk: JSON.stringify({
              type: 'complete_response',
              text: result.llmResponse
            })
          });
        }

        if (chunk.end_of_stream) {
          call.end();
        }
        return;
      }

      // Handle Audio Input
      if (chunk.audio_chunk && chunk.audio_chunk.length > 0) {
        logger.info(`[AUDIO-FLOW-1] Received audio chunk for session ${currentSessionId}`, {
          chunkSize: chunk.audio_chunk.length,
          sampleRate: 16000,
          timestamp: new Date().toISOString()
        });

        try {
          await sessionCoordinator.processAudioChunk(
            currentSessionId,
            chunk.audio_chunk,
            16000
          );
          logger.info(`[AUDIO-FLOW-2] Audio chunk processed successfully for session ${currentSessionId}`);
        } catch (error: any) {
          logger.error(`[AUDIO-FLOW-ERROR] Failed to process audio chunk for session ${currentSessionId}`, {
            error: error.message,
            stack: error.stack
          });
        }
      }

      if (chunk.end_of_stream) {
        logger.info(
          `End of audio stream received for session: ${currentSessionId}.`
        );

        try {
          // Note: With new architecture, LLM responses stream via callbacks
          // We need to ensure the final audio chunk is processed and STT is finalized
          await sessionCoordinator.finishAudioStream(currentSessionId);
        } catch (error: any) {
          logger.error(`Error in session ${currentSessionId}: ${error.message}`);
        } finally {
          call.end(); // End the bidirectional stream
        }
      }
    }
  });

  call.on("end", () => {
    logger.info(
      `gRPC SendAudioStream ended for session: ${currentSessionId || "unknown"
      }.`
    );
  });

  call.on("error", (error: Error) => {
    logger.error(
      `gRPC SendAudioStream error for session ${currentSessionId || "unknown"
      }: ${error.message}`
    );
    if (currentSessionId) {
      sessionCoordinator.endSession(currentSessionId);
    }
    call.end();
  });
};

const EndSession = async (
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> => {
  const { session_id } = call.request;

  if (!session_id) {
    logger.warn('EndSession called without session_id');
    callback({
      code: grpc.status.INVALID_ARGUMENT,
      details: 'Session ID is required',
    });
    return;
  }

  try {
    const ended = await sessionCoordinator.endSession(session_id);
    if (ended) {
      logger.info(`gRPC EndSession successful for session: ${session_id}`);
      callback(null, {
        success: true,
        message: "Session ended",
        sessionSummary: "Session closed successfully.",
      });
    } else {
      logger.warn(`Attempted to end non-existent session: ${session_id}`);
      callback({
        code: grpc.status.NOT_FOUND,
        details: `Session ${session_id} not found.`,
      });
    }
  } catch (error: any) {
    logger.error(
      `Error in EndSession for session ${session_id}: ${error.message}`
    );
    callback({
      code: grpc.status.INTERNAL,
      details: `Failed to end session: ${error.message}`,
    });
  }
};

export function startGrpcServer(): void {
  const server = new grpc.Server();
  server.addService(gnani_proto.GnaniService.service, {
    StartSession: StartSession,
    SendAudioStream: SendAudioStream,
    EndSession: EndSession,
  });

  server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        logger.error(`gRPC server failed to bind: ${err.message}`);
      } else {
        logger.info(`gRPC server listening on port ${port}`);
        server.start();
      }
    }
  );
}
