declare module "jsbarcode" {
  function JsBarcode(
    element: HTMLElement | SVGElement | string,
    value: string,
    options?: Record<string, unknown>,
  ): void;
  export default JsBarcode;
}
