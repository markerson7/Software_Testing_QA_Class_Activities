export const add = (a, b) => a + b;    
export const multiply = (a, b) => a * b;
export const divide = (a, b) => {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
};

export default {
     add, 
     multiply, 
     divide 
};