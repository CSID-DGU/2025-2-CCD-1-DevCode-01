import { useParams, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { fonts } from "@styles/fonts";
import UploadBar from "src/components/lecture/UploadBar";
import { DocList, ListItem } from "src/components/lecture/DocList";
import DocItem from "src/components/lecture/DocItem";
import { useLectureDocs } from "src/hooks/useLectureDocs";

type RouteParams = { courseId?: string };

export default function LectureDocs() {
  const { courseId } = useParams<RouteParams>();
  const nav = useNavigate();

  const lectureNumericId = Number.parseInt(courseId ?? "", 10);
  const hasValidId = Number.isFinite(lectureNumericId) && lectureNumericId > 0;

  const { busy, docs, upload, remove, updateTitle } = useLectureDocs(
    hasValidId ? lectureNumericId : null
  );

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

  return (
    <Wrap aria-busy={busy} aria-labelledby="lecture-docs-heading">
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
                onOpen={(d) => nav(`/lecture/${lectureNumericId}/doc/${d.id}`)}
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

      <Right role="complementary" aria-label="메모">
        <MemoCard>
          <MemoTitle id="memo-title">MEMO</MemoTitle>
          <MemoBody aria-describedby="memo-title">
            • 다음주까지 과제 제출
            <br />• 수업 때 명찰 꼭 가져오기
          </MemoBody>
          <label className="sr-only" htmlFor="memo-input">
            메모 입력
          </label>
          <MsgInput id="memo-input" placeholder="메시지 입력" />
        </MemoCard>
      </Right>
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
const MemoCard = styled.section`
  background: #fde68a;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #e6c65a;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 1rem;
`;
const MemoTitle = styled.h3`
  margin: 0 0 1rem;
  ${fonts.bold32};
`;
const MemoBody = styled.p`
  ${fonts.regular20};
  min-height: 8rem;
`;
const MsgInput = styled.input`
  margin-top: 1rem;
  width: 100%;
  ${fonts.regular20};
  padding: 0.9rem 1rem;
  border: 2px solid var(--c-grayL);
  border-radius: 12px;
  background: #fff5d1;
  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;
  }
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
