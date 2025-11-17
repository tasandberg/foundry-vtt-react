const logger =
  (namespace: string): ((message: string) => void) =>
  (message: string) => {
    console.log(`%c[foundry-vtt-react][${namespace}]`, "color: tomato;", message);
  };

export default logger;
