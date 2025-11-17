const logger =
  (namespace: string): ((message: string) => void) =>
  (message: string) => {
    console.log(`%c[foundry-vtt-react-application][${namespace}]`, "color: blue;", message);
  };

export default logger;
