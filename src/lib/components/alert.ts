import { writable } from "svelte/store";

export type ToastType = "error" | "confirm" | "success" | "notification";

export interface Toast {
  _id: number;
  msg: string;
  type: ToastType;
  onClose?: (() => void) | false;
  resolver?: (value: boolean) => void;
}

export const toasts = writable<Toast[]>([]);

export const toastClasses: Record<ToastType, string> = {
  error: "bg-red-900/90 text-red-100 border-red-700",
  confirm: "bg-blue-900/90 text-blue-100 border-blue-700",
  success: "bg-green-900/90 text-green-100 border-green-700",
  notification: "bg-neutral-800/90 text-neutral-100 border-neutral-700",
};

let toastId = 0;

export const alert = (
  msg = "",
  type: ToastType = "notification",
  autoHide = true,
  onClose: (() => void) | false = false,
  retainMs = type === "error" ? 8500 : 3500,
) => {
  const _id = ++toastId;
  toasts.update((items) => [...items, { _id, msg, type, onClose }]);
  if (autoHide) {
    setTimeout(() => removeToast(_id), retainMs);
  }
};

export const confirm = (msg = "") =>
  new Promise<boolean>((resolve) => {
    const _id = ++toastId;
    toasts.update((items) => [...items, { _id, msg, type: "confirm", resolver: resolve }]);
  });

export const removeToast = (_id: number, confirmed = false) => {
  let removedToast: Toast | undefined;

  toasts.update((items) => {
    removedToast = items.find((item) => item._id === _id);
    return items.filter((item) => item._id !== _id);
  });

  if (removedToast?.resolver) {
    removedToast.resolver(confirmed);
    return;
  }

  if (removedToast?.onClose) {
    removedToast.onClose();
  }
};
