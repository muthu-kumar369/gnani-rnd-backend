// backend/src/server/grpc_server.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { GRPC_PORT } from '../configs/config.js';
import logger from '../utils/logger.js';
import sessionManager from '../services/sessionManager.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gRPC service definition
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'gnani.proto');

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
const gnani_proto = grpc.loadPackageDefinition(packageDefinition).gnani as any;

// Implement gRPC service methods
const StartSession = (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>): void => {
    const { userId } = call.request; // We only need userId for session management here
    try {
        const onTranscriptionCallback = (transcript: string, isFinal: boolean) => {
            logger.debug(`StartSession callback received transcript for ${userId}: ${transcript} (isFinal: ${isFinal})`);
        };

        const newSessionId = sessionManager.startSession(userId, onTranscriptionCallback);
        logger.info(`gRPC StartSession successful. New session ID: ${newSessionId} for user: ${userId}`);
        callback(null, { success: true, message: 'Session started', sessionId: newSessionId });
    } catch (error: any) {
        logger.error(`Error in StartSession for user ${userId}: ${error.message}`);
        callback({
            code: grpc.status.INTERNAL,
            details: `Failed to start session: ${error.message}`
        });
    }
};

const SendAudioStream = (call: grpc.ServerDuplexStream<any, any>): void => {
    let currentSessionId: string | null = null;

    const setCallForSession = (sessionId: string, grpcCall: grpc.ServerDuplexStream<any, any>) => {
        const session = sessionManager.getSession(sessionId);
        if (session) {
            session.metadata.grpcCall = grpcCall;
            session.onTranscriptionCallback = (transcript: string, isFinal: boolean) => {
                if (grpcCall) {
                    grpcCall.write({
                        sessionId: sessionId,
                        transcription: transcript,
                        llm_response: isFinal ? 'Placeholder LLM response' : '',
                        action_directive: isFinal ? 'Placeholder action' : ''
                    });
                }
            };
        }
    };

    call.on('data', async (chunk: any) => {
        if (!currentSessionId) {
            currentSessionId = chunk.sessionId;
            if (currentSessionId) {
                const session = sessionManager.getSession(currentSessionId);
                if (!session) {
                    logger.warn(`Received audio chunk for unknown session: ${currentSessionId}. Ending stream.`);
                    call.end(); // End the stream if session is unknown
                    return;
                }
                logger.info(`gRPC SendAudioStream started for session: ${currentSessionId}`);
                setCallForSession(currentSessionId, call); // Store the call object for this session
            }
        }

        if (currentSessionId) {
            const session = sessionManager.getSession(currentSessionId);
            if (!session) {
                logger.warn(`Session ${currentSessionId} not found during SendAudioStream. Ending stream.`);
                call.end();
                return;
            }

            await sessionManager.appendAudioChunk(currentSessionId, chunk.audio_chunk, 16000);

            if (chunk.end_of_stream) {
                logger.info(`End of audio stream received for session: ${currentSessionId}.`);
                await sessionManager.finalizeSessionProcessing(currentSessionId);
                call.end(); // End the bidirectional stream
                sessionManager.endSession(currentSessionId); // End the session in manager
            }
        }
    });

    call.on('end', () => {
        logger.info(`gRPC SendAudioStream ended for session: ${currentSessionId || 'unknown'}.`);
        if (currentSessionId && sessionManager.getSession(currentSessionId)) {
            sessionManager.endSession(currentSessionId);
        }
    });

    call.on('error', (error: Error) => {
        logger.error(`gRPC SendAudioStream error for session ${currentSessionId || 'unknown'}: ${error.message}`);
        if (currentSessionId) {
            sessionManager.endSession(currentSessionId);
        }
        call.end();
    });
};

const EndSession = (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>): void => {
    const { sessionId } = call.request;
    try {
        const ended = sessionManager.endSession(sessionId);
        if (ended) {
            logger.info(`gRPC EndSession successful for session: ${sessionId}`);
            callback(null, { success: true, message: 'Session ended', sessionSummary: 'Session closed successfully.' });
        } else {
            logger.warn(`Attempted to end non-existent session: ${sessionId}`);
            callback({
                code: grpc.status.NOT_FOUND,
                details: `Session ${sessionId} not found.`
            });
        }
    } catch (error: any) {
        logger.error(`Error in EndSession for session ${sessionId}: ${error.message}`);
        callback({
            code: grpc.status.INTERNAL,
            details: `Failed to end session: ${error.message}`
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

    server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            logger.error(`gRPC server failed to bind: ${err.message}`);
        } else {
            logger.info(`gRPC server listening on port ${port}`);
            server.start();
        }
    });
}
