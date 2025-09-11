describe('Setup Verfication', () => {
  test('node js is working', () => {
    expect(typeof process.version).toBe('string');
  });  

  test('Basic operations', () => {
    expect(2 + 2).toBe(4);
  });

  test('ES modules are working', () => {
    const testFunction = () => 'ES Modules are working';
    expect(testFunction()).toBe('ES Modules are working');
  } );  
})