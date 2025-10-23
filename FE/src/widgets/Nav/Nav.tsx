import { useNavigate } from "react-router-dom";
import { useContrastMode } from "@shared/useContrastMode";
import * as s from "./style";
import type { NavVariant } from "./types";
import { useContrastImage } from "@shared/useContrastImage";

type Props = { variant: NavVariant; title?: string };

// 우측 공통 아이콘: 모든 페이지에서 동일하게 표시 (맨 오른쪽 고정)
const RightActions = ({
  isHC,
  toggleMode,
  onRead,
}: {
  isHC: boolean;
  toggleMode: () => void;
  onRead?: () => void;
}) => (
  <>
    <s.ActionButton
      type="button"
      onClick={onRead}
      aria-label="화면읽기"
      title="화면읽기"
    >
      <img src="/img/nav/sound.png" alt="" aria-hidden />
      <em>화면읽기</em>
    </s.ActionButton>

    <s.ActionButton
      type="button"
      onClick={toggleMode}
      aria-pressed={isHC}
      aria-label="화면설정"
      title="화면설정"
    >
      <img src="/img/nav/eye.png" alt="" aria-hidden />
      <em>화면설정</em>
    </s.ActionButton>
  </>
);

const Nav = ({ variant, title }: Props) => {
  const nav = useNavigate();
  const { isHC, toggleMode } = useContrastMode();

  const logo = useContrastImage("/img/nav/logo");
  const sound = useContrastImage("/img/nav/sound");
  const eye = useContrastImage("/img/nav/eye");
  const back = useContrastImage("/img/nav/back");

  // ===== 1) 로그인/회원가입 네브바 =====
  if (variant === "auth") {
    return (
      <s.NavWrapper
        role="banner"
        aria-label="로그인/회원가입 네비게이션"
        data-variant="auth"
      >
        <s.BrandArea>
          <img src={logo} alt="" aria-hidden />
          <s.BrandText aria-label={title ?? "캠퍼스 메이트"}>
            {title ?? "캠퍼스 메이트"}
          </s.BrandText>
        </s.BrandArea>

        <s.Actions>
          <RightActions
            isHC={isHC}
            toggleMode={toggleMode}
            onRead={() => {
              /* 안내/튜토리얼 */
            }}
          />
        </s.Actions>
      </s.NavWrapper>
    );
  }

  return (
    <s.NavWrapper data-variant={variant}>
      {/* Left */}
      <s.Left>
        {variant === "folder" ? (
          <s.FolderLeft>
            <img src={logo} alt="" aria-hidden />
            <s.TabNav role="tablist" aria-label="폴더 탭">
              <s.TabLink to="/" role="tab" aria-selected end>
                홈
              </s.TabLink>
              <s.TabLink to="/exam" role="tab">
                시험
              </s.TabLink>
            </s.TabNav>
          </s.FolderLeft>
        ) : ["pre", "live", "live-recording", "post", "exam"].includes(
            variant
          ) ? (
          <s.IconButton aria-label="뒤로가기" onClick={() => nav(-1)}>
            <img src={back} />
          </s.IconButton>
        ) : (
          <span aria-hidden />
        )}
      </s.Left>

      {/* Center */}
      <s.Title aria-live="polite">{title ?? " "}</s.Title>

      {/* Right */}
      <s.Right>
        {variant === "live" && (
          <s.IconLink to="?rec=1" aria-label="녹음 시작">
            ⏺
          </s.IconLink>
        )}
        {variant === "live-recording" && (
          <>
            <s.RecordingBadge role="status" aria-live="polite">
              ● 녹음 중
            </s.RecordingBadge>
            <s.IconLink to="?rec=0" aria-label="일시정지">
              ⏸
            </s.IconLink>
          </>
        )}
        {/* 공통: 화면읽기 / 화면설정 */}
        <s.ActionButton type="button" aria-label="화면읽기" title="화면읽기">
          <img src={sound} alt="" aria-hidden />
          <em>화면읽기</em>
        </s.ActionButton>
        <s.ActionButton
          type="button"
          onClick={toggleMode}
          aria-pressed={isHC}
          aria-label="화면설정"
          title="화면설정"
        >
          <img src={eye} alt="" aria-hidden />
          <em>화면설정</em>
        </s.ActionButton>
      </s.Right>
    </s.NavWrapper>
  );
};

export default Nav;
