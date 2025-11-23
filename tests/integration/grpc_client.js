import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';


const PROTO_PATH = path.join(process.cwd(), 'src', 'proto', 'gnani.proto');
const GRPC_SERVER_ADDRESS = 'localhost:50051';

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
console.log('gnani_proto:', gnani_proto);
console.log('gnani_proto.StartSessionResponse:', gnani_proto.StartSessionResponse);

const client = new gnani_proto.GnaniService(
    GRPC_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
);

// Helper function to strip WAV header (assuming 44-byte header for simplicity)
function stripWavHeader(wavBuffer) {
    // For standard WAV files, the header is 44 bytes.
    // This is a simplified approach; a more robust solution would parse the header
    // to find the actual data chunk size and offset.
    const HEADER_SIZE = 44;
    if (wavBuffer.length < HEADER_SIZE) {
        console.warn('WAV buffer is smaller than expected header size. Returning full buffer.');
        return wavBuffer;
    }
    return wavBuffer.slice(HEADER_SIZE);
}

async function main() {
    try {
        // For testing purposes, we'll use placeholder user ID and token.
        const userId = 'test_user_id';
        const token = 'test_token_string';
        // Create metadata for gRPC calls
        const metadata = new grpc.Metadata();
        metadata.add('authorization', `Bearer ${token}`);

        // 1. Start Session
        console.log('1. Calling StartSession...');
        const startSessionResponse = await new Promise((resolve, reject) => {
            client.StartSession({ user_id: userId }, metadata, (error, response) => {
                if (error) {
                    return reject(error);
                }
                resolve(response);
            });
        });
        console.log('StartSession Response:', startSessionResponse);
        const sessionId = startSessionResponse.session_id; // Access session_id directly
        if (!sessionId) {
            throw new Error('Failed to get sessionId from StartSession response.');
        }

        // 2. Send Audio Stream
        console.log('\n2. Calling SendAudioStream...');
        const call = client.SendAudioStream(metadata); // Pass metadata to the stream

        call.on('data', (response) => {
            console.log('SendAudioStream Response:', response);
            // Here you would typically process transcription, LLM response, action directives
        });

        call.on('end', () => {
            console.log('SendAudioStream ended.');
        });
        
        call.on('error', (e) => {
            console.error('SendAudioStream Error:', e.message);
        });

        const audioFilePath = path.join(process.cwd(), 'tests', 'test_data', 'speech_test.wav');
        const wavAudioBuffer = fs.readFileSync(audioFilePath);
        const rawPcmData = stripWavHeader(wavAudioBuffer); // Strip the WAV header
        
        const chunkSize = 3200; // Example chunk size (adjust as needed)
        let offset = 0;

        console.log(`Streaming audio from ${audioFilePath} (Original WAV size: ${wavAudioBuffer.length} bytes, Raw PCM size: ${rawPcmData.length} bytes)`);

        while (offset < rawPcmData.length) {
            const chunk = rawPcmData.slice(offset, offset + chunkSize);
            offset += chunkSize;
            const isEndOfStream = offset >= rawPcmData.length;

            console.log(`Sending chunk (size: ${chunk.length}, end_of_stream: ${isEndOfStream})`);
            call.write({
                session_id: sessionId,
                audio_chunk: chunk,
                end_of_stream: isEndOfStream
            });
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate real-time streaming delay
        }

        call.end(); // Signal end of client stream
        await new Promise(resolve => setTimeout(resolve, 2000)); // Give server time to process final chunks

        // 3. End Session
        console.log('\n3. Calling EndSession...');
        const endSessionResponse = await new Promise((resolve, reject) => {
            client.EndSession({ sessionId: sessionId }, metadata, (error, response) => {
                if (error) {
                    return reject(error);
                }
                resolve(response);
            });
        });
        console.log('EndSession Response:', endSessionResponse);

    } catch (e) {
        console.error('gRPC Client Error:', e.message);
    }
}

main();