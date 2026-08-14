import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

async function run() {
    console.log('--- Mongoose Model Verification Script ---');

    const modelsPath = path.join(__dirname, '../src/models');
    const modelFiles = fs.readdirSync(modelsPath).filter(f => f.endsWith('.ts') && f !== 'index.ts');

    console.log(`Found ${modelFiles.length} model files.`);

    // Attempt to load all models
    console.log('\nAttempting first load of all models...');
    for (const file of modelFiles) {
        try {
            const modelName = file.replace('.ts', '');
            require(path.join(modelsPath, file));
            console.log(`✅ Loaded ${modelName}`);
        } catch (error: any) {
            console.error(`❌ Failed to load ${file}:`, error.message);
        }
    }

    // Attempt to reload all models to trigger overwrite error if guard fails
    console.log('\nAttempting second load (reload) of all models to test guards...');
    for (const file of modelFiles) {
        try {
            const modelPath = path.join(modelsPath, file);
            // Clear cache to force re-execution of the file
            delete require.cache[require.resolve(modelPath)];
            require(modelPath);
            console.log(`✅ Reloaded ${file.replace('.ts', '')} (Guard worked)`);
        } catch (error: any) {
            if (error.message.includes('Cannot overwrite')) {
                console.error(`🚨 OVERWRITE ERROR in ${file}:`, error.message);
            } else {
                console.error(`❌ Unexpected error in ${file}:`, error.message);
            }
        }
    }

    console.log('\n--- Verification Complete ---');
    process.exit(0);
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
