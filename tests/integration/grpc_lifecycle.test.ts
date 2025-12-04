import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import assert from 'assert';

const PROTO_PATH = path.join(process.cwd(), 'src', 'proto', 'gnani.proto');
const GRPC_SERVER_ADDRESS = '127.0.0.1:50051';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const gnani_proto = grpc.loadPackageDefinition(packageDefinition).gnani as any;

const client = new gnani_proto.GnaniService(
    GRPC_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
);

async function runTest() {
    console.log('Running gRPC Session Lifecycle Test...');
    const userId = 'test_lifecycle_user';
    const metadata = new grpc.Metadata();
    metadata.add('authorization', 'Bearer test_token');

    try {
        // 1. Test StartSession
        console.log('1. Testing StartSession...');
        const startResponse: any = await new Promise((resolve, reject) => {
            client.StartSession({ user_id: userId }, metadata, (err: any, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });

        assert.ok(startResponse, 'Response should be defined');
        assert.strictEqual(startResponse.success, true, 'StartSession success should be true');
        assert.ok(startResponse.session_id, 'session_id should be present');
        console.log('   ✓ StartSession passed. Session ID:', startResponse.session_id);

        const sessionId = startResponse.session_id;

        // 2. Test EndSession
        console.log('2. Testing EndSession...');
        const endResponse: any = await new Promise((resolve, reject) => {
            client.EndSession({ session_id: sessionId }, metadata, (err: any, res: any) => {
                if (err) reject(err);
                else resolve(res);
            });
        });

        assert.ok(endResponse, 'Response should be defined');
        assert.strictEqual(endResponse.success, true, 'EndSession success should be true');
        console.log('   ✓ EndSession passed.');

        console.log('\nAll gRPC Lifecycle tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\nTest Failed:', error);
        process.exit(1);
    }
}

runTest();
