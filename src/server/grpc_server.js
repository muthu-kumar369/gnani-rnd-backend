// backend/src/server/grpc_server.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { GRPC_PORT } = require('../configs/config');
const logger = require('../utils/logger');
const sessionManager = require('../services/sessionManager');

// gRPC service definition
const PROTO_PATH = __dirname + '/../proto/gnani.proto';
const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
const gnani_proto = grpc.loadPackageDefinition(packageDefinition).gnani;

// Implement gRPC service methods
const StartSession = (call, callback) => {
    const { userId } = call.request; // We only need userId for session management here
    try {
        // Pass a function to sessionManager that will write back to the client stream
        const onTranscriptionCallback = (transcript, isFinal) => {
            // Note: The gRPC stream in SendAudioStream is separate.
            // For StartSession, we just respond with the session ID.
            // Real-time transcription feedback goes through the SendAudioStream bidirectional stream.
            // This callback is conceptually for the overall session manager to know
            // where to send data for THIS specific session, which in this case
            // would eventually be linked to the active SendAudioStream 'call' object.
            // For now, we'll store the 'call' object itself in the session metadata
            // and use it in SendAudioStream logic.
            logger.debug(`StartSession callback received transcript for ${userId}: ${transcript} (isFinal: ${isFinal})`);
        };

        const newSessionId = sessionManager.startSession(userId, onTranscriptionCallback);
        logger.info(`gRPC StartSession successful. New session ID: ${newSessionId} for user: ${userId}`);
        callback(null, { success: true, message: 'Session started', sessionId: newSessionId });
    } catch (error) {
        logger.error(`Error in StartSession for user ${userId}: ${error.message}`);
        callback({
            code: grpc.status.INTERNAL,
            details: `Failed to start session: ${error.message}`
        });
    }
};


const SendAudioStream = (call) => {
    let currentSessionId = null;

    // Store the gRPC call object in the session manager for this session
    // This allows the sessionManager to write back to this specific client stream
    const setCallForSession = (sessionId, grpcCall) => {
        const session = sessionManager.getSession(sessionId);
        if (session) {
            session.metadata.grpcCall = grpcCall;
            session.onTranscriptionCallback = (transcript, isFinal) => {
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

    call.on('data', async (chunk) => {
        if (!currentSessionId) {
            currentSessionId = chunk.sessionId;
            const session = sessionManager.getSession(currentSessionId);
            if (!session) {
                logger.warn(`Received audio chunk for unknown session: ${currentSessionId}. Ending stream.`);
                call.end(); // End the stream if session is unknown
                return;
            }
            logger.info(`gRPC SendAudioStream started for session: ${currentSessionId}`);
            setCallForSession(currentSessionId, call); // Store the call object for this session
        }

        const session = sessionManager.getSession(currentSessionId);
        if (!session) {
            logger.warn(`Session ${currentSessionId} not found during SendAudioStream. Ending stream.`);
            call.end();
            return;
        }

        // The sessionManager now handles processing, sending to Whisper, and writing back to this stream
        // Input sample rate is hardcoded for now, but should ideally come from client or config
        await sessionManager.appendAudioChunk(currentSessionId, chunk.audio_chunk, 16000);

        if (chunk.end_of_stream) {
            logger.info(`End of audio stream received for session: ${currentSessionId}.`);
            await sessionManager.finalizeSessionProcessing(currentSessionId);
            call.end(); // End the bidirectional stream
            sessionManager.endSession(currentSessionId); // End the session in manager
        }
    });

    call.on('end', () => {
        logger.info(`gRPC SendAudioStream ended for session: ${currentSessionId || 'unknown'}.`);
        if (currentSessionId && sessionManager.getSession(currentSessionId)) {
            // If the client ends stream without end_of_stream flag, finalize here
            sessionManager.endSession(currentSessionId);
        }
    });

    call.on('error', (error) => {
        logger.error(`gRPC SendAudioStream error for session ${currentSessionId || 'unknown'}: ${error.message}`);
        if (currentSessionId) {
            sessionManager.endSession(currentSessionId);
        }
        call.end();
    });
};

const EndSession = (call, callback) => {
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
    } catch (error) {
        logger.error(`Error in EndSession for session ${sessionId}: ${error.message}`);
        callback({
            code: grpc.status.INTERNAL,
            details: `Failed to end session: ${error.message}`
        });
    }
};

function startGrpcServer() {
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

module.exports = { startGrpcServer };
