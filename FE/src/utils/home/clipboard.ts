import toast from "react-hot-toast";

export const copyLectureCode = async (code?: string) => {
  if (!code) {
    toast.error("이 강의는 코드가 없어요.");
    return;
  }
  try {
    if (!navigator.clipboard?.writeText) {
      toast.error("이 환경에서 클립보드를 지원하지 않아요.");
      return;
    }
    await navigator.clipboard.writeText(code);
    toast.success(`강의 코드 복사됨: ${code}`);
  } catch {
    toast.error("클립보드 접근에 실패했어요. 브라우저 권한을 확인해 주세요.");
  }
};
