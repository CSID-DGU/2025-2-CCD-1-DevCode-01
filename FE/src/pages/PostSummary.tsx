import type { SpeechSummaryItem } from "@apis/lecture/profTts.api";
import { useLocation } from "react-router-dom";

export const PostSummary = () => {
  const { state } = useLocation();

  const summaries: SpeechSummaryItem[] = state?.summaries ?? [];

  return (
    <>
      <ul>
        {summaries.map((s) => (
          <li key={s.speechSummaryId}>
            {s.createdAt} - ID: {s.speechSummaryId}
          </li>
        ))}
      </ul>
    </>
  );
};
