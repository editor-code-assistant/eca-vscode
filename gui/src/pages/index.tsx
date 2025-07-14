import { Chat } from "./chat/Chat";

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
