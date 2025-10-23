// src/layouts/DefaultLayout.tsx
import {
  Outlet,
  useMatches,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import styled from "styled-components";
import Nav from "@widgets/Nav/Nav";
import type { NavMeta } from "@widgets/Nav/types";

const DefaultLayout = () => {
  const matches = useMatches();
  const params = useParams();
  const [sp] = useSearchParams();
  const { state } = useLocation() as { state?: { subject?: string } };

  const last = matches[matches.length - 1];
  const navMeta = (last?.handle as { nav?: NavMeta })?.nav;

  // live에서 ?rec=1이면 live-recording으로 전환
  const isRecording = sp.get("rec") === "1";
  const baseVariant = navMeta?.variant ?? "folder";
  const variant =
    baseVariant === "live" && isRecording ? "live-recording" : baseVariant;

  // exam은 상태로 과목명을 보낼 수 있음 (navigate('/exam', {state:{subject:'정치학개론'}}))
  const computedTitle =
    baseVariant === "exam" && state?.subject
      ? `${state.subject} 시험`
      : typeof navMeta?.title === "function"
      ? navMeta.title(params as any)
      : navMeta?.title;

  return (
    <Wrapper>
      <Nav variant={variant} title={computedTitle} />
      <Outlet />
    </Wrapper>
  );
};

export default DefaultLayout;

const Wrapper = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100dvh;
`;
