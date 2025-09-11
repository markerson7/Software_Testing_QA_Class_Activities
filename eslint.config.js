import js from '@eslint/js';
export default [
js.configs.recommended,
{
languageOptions: {
globals: {
    //    ...js.environments.node.globals,
describe: 'readonly', 
test: 'readonly', 
expect: 'readonly', 
beforeEach: 'readonly', 
afterEach: 'readonly',
beforeAll: 'readonly', 
afterAll: 'readonly'
}
}
}
];