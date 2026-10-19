import type { AlertMessage } from "@/api/types";
import { Notice } from "./States";

export function MessagePreview({ message, footer }: { message: AlertMessage; footer?: string }) {
  return (
    <div className="stack">
      <div className="phone" aria-label="Message preview">
        <div className="bubble kn" lang="kn">
          {message.message_kn}
          <div className="bubble-meta">ಕನ್ನಡ · Kannada{footer ? ` · ${footer}` : ""}</div>
        </div>
        <div className="bubble en" lang="en">
          {message.message_en}
          <div className="bubble-meta">English translation</div>
        </div>
      </div>
      {!message.kannada_reviewed && (
        <Notice tone="warn">Kannada wording is a draft template and has not yet been reviewed by a native speaker.</Notice>
      )}
    </div>
  );
}
