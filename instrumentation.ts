export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register: registerQR } = await import("next-dev-qr");
    registerQR();
  }
}
