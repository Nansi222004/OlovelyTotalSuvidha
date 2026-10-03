const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const compile = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const entry = process.argv[2];
if (!entry) throw new Error('TypeScript test entry path is required');
require(path.resolve(process.cwd(), entry));
