
import vectorManager from '../../src/modules/vector/vector.manager.js';

async function testEmbeddings() {
    console.log('Testing Embedding Generation...');

    // Give it a moment to initialize
    console.log('Waiting for model initialization...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const text1 = "Hello world";
    const text2 = "Hi there";
    const text3 = "Banana";

    const emb1 = await vectorManager.generateEmbedding(text1);
    const emb2 = await vectorManager.generateEmbedding(text2);
    const emb3 = await vectorManager.generateEmbedding(text3);

    console.log(`Embedding 1 length: ${emb1.length}`);
    console.log(`Embedding 1 (first 5): ${emb1.slice(0, 5)}`);

    // Calculate cosine similarity
    const similarity = (a: number[], b: number[]) => {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dot / (magA * magB);
    };

    const sim12 = similarity(emb1, emb2);
    const sim13 = similarity(emb1, emb3);

    console.log(`Similarity "Hello world" vs "Hi there": ${sim12.toFixed(4)}`);
    console.log(`Similarity "Hello world" vs "Banana": ${sim13.toFixed(4)}`);

    if (sim12 > sim13) {
        console.log('SUCCESS: Semantic similarity works!');
    } else {
        console.error('FAILURE: Semantic similarity check failed.');
    }
}

testEmbeddings().catch(console.error);
