type ToastProps = {
  message: string;
  type: "success" | "error";
};

export function Toast({ message, type }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 rounded-lg py-4 px-3 text-sm ${type === "success" ? "bg-green-700 text-white" : "bg-red-700 text-white"}`}
    >
      {message}
    </div>
  );
}
