import { useParams, useNavigate } from "react-router-dom";
import styled from "styled-components";

import UploadBar from "src/components/lecture/UploadBar";
import { DocList, ListItem } from "src/components/lecture/DocList";
import DocItem from "src/components/lecture/DocItem";
import { useLectureDocs } from "src/hooks/useLectureDocs";
import MemoListCard from "src/components/lecture/MemoCard";
import { useLectureMemoList } from "src/hooks/useLectureMemoList";

import type { LectureDoc } from "src/entities/doc/types";
import ReviewRecordModal from "src/components/lecture/pre/ReviewRecordModal";
import { useCallback, useRef, useState } from "react";
import { applyPlaybackRate, useSoundOptions } from "src/hooks/useSoundOption";
import { useOcrTtsAutoStop } from "src/hooks/useOcrTtsAutoStop";
import type { LectureNote } from "@apis/lecture/memo.api";

type RouteParams = { courseId?: string };

export default function LectureDocs() {
  const { courseId } = useParams<RouteParams>();
  const nav = useNavigate();

  const lectureNumericId = Number.parseInt(courseId ?? "", 10);
  const hasValidId = Number.isFinite(lectureNumericId) && lectureNumericId > 0;

  const { busy, docs, upload, remove, updateTitle } = useLectureDocs(
    hasValidId ? lectureNumericId : null
  );

  const {
    loading: memoLoading,
    items,
    saveAll,
    iconOf,
  } = useLectureMemoList(hasValidId ? lectureNumericId : null);

  const [reviewDoc, setReviewDoc] = useState<LectureDoc | null>(null);

  const memoAreaRef = useRef<HTMLElement | null>(null);
  const memoAudioRef = useRef<HTMLAudioElement | null>(null);
  const { soundRate, soundVoice } = useSoundOptions();

  useOcrTtsAutoStop(memoAudioRef, {
    areaRef: memoAreaRef as React.RefObject<HTMLElement | null>,
    stopMessageOnBlur: "메모 음성 재생이 중지되었습니다.",
  });

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      return `${y}. ${m}. ${day}`;
    } catch {
      return iso;
    }
  };

  const playNoteTts = useCallback(
    async (note: LectureNote) => {
      const tts = note.note_tts;
      if (!tts) return;

      const femaleUrl = tts.female ?? undefined;
      const maleUrl = tts.male ?? undefined;

      let url: string | undefined;
      if (soundVoice === "여성") {
        url = femaleUrl ?? maleUrl;
      } else {
        url = maleUrl ?? femaleUrl;
      }
      if (!url) return;

      const audio = memoAudioRef.current;
      if (!audio) return;

      if (!audio.src || audio.src !== url) {
        audio.src = url;
      }

      applyPlaybackRate(audio, soundRate);
      audio.currentTime = 0;

      try {
        await audio.play();
      } catch (err) {
        console.error("[LectureDocs] 메모 TTS 재생 실패:", err);
      }
    },
    [soundRate, soundVoice]
  );

  return (
    <Wrap
      aria-busy={busy || memoLoading}
      aria-labelledby="lecture-docs-heading"
    >
      <SrOnly as="h1" id="lecture-docs-heading">
        교안 목록
      </SrOnly>

      <UploadBar onSelectFile={upload} />

      <Left role="region" aria-label="교안 목록">
        <DocList role="list" aria-describedby="doc-list-desc">
          <SrOnly id="doc-list-desc">
            항목을 클릭하면 해당 교안을 열 수 있습니다. 각 항목의 옵션 버튼으로
            수정 또는 삭제를 할 수 있습니다.
          </SrOnly>

          {docs.map((doc) => (
            <ListItem key={doc.id} role="listitem">
              <DocItem
                doc={doc}
                fmtDate={fmtDate}
                onOpen={(d) => {
                  if (d.review) {
                    setReviewDoc(d);
                  } else {
                    nav(`/lecture/doc/${d.id}`, {
                      state: {
                        navTitle: d.title,
                        resumeClock: d.timestamp ?? null,
                      },
                    });
                  }
                }}
                onDelete={async () => {
                  await remove(doc.id);
                }}
                onTitleUpdated={async (id, newTitle) => {
                  await updateTitle(id, newTitle);
                }}
              />
            </ListItem>
          ))}
        </DocList>
      </Left>

      <Right ref={memoAreaRef} role="complementary" aria-label="메모">
        <audio ref={memoAudioRef} preload="none" />
        <MemoListCard
          items={items}
          onSaveAll={async (lines) => {
            if (!hasValidId) return;
            await saveAll(lines);
          }}
          iconOf={iconOf}
          stickyTop="1rem"
          onFocusNote={playNoteTts}
        />
      </Right>
      <ReviewRecordModal
        open={!!reviewDoc}
        onClose={() => setReviewDoc(null)}
        onReview={() => {
          if (!reviewDoc) return;
          nav(`/lecture/doc/${reviewDoc.id}/post`, {
            state: {
              navTitle: reviewDoc.title,
              resumeClock: reviewDoc.timestamp ?? null,
            },
          });
          setReviewDoc(null);
        }}
        onContinue={() => {
          if (!reviewDoc) return;
          nav(`/lecture/doc/${reviewDoc.id}`, {
            state: {
              navTitle: reviewDoc.title,
              resumeClock: reviewDoc.timestamp ?? null,
            },
          });
          setReviewDoc(null);
        }}
      />
    </Wrap>
  );
}

const Wrap = styled.section`
  display: grid;
  grid-template-columns: 1fr 420px;
  grid-template-rows: auto 1fr;
  gap: 1.5rem;
  width: 100%;
  padding: 2rem;
`;
const Left = styled.section`
  grid-row: 2;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;
const Right = styled.aside`
  grid-row: 2;
  min-width: 280px;
`;
const SrOnly = styled.h2`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
