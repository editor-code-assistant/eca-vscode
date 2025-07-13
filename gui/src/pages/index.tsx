import { Chat } from "./Chat";

declare global {
  interface Window {
    vscodeMediaUrl: string;
  }
}

export default function GUI() {
    return (
        <Chat />
    );
}
