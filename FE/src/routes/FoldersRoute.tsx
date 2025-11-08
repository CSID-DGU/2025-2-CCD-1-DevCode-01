import { useNavigate } from "react-router-dom";
import LectureHome from "@pages/home/LectureHome";
import type { Lecture } from "src/entities/lecture/types";

export default function FoldersRoute() {
  const navigate = useNavigate();
  const handleOpen = (lec: Lecture) => {
    navigate(`/lecture/${lec.lecture_id}/doc`);
  };
  return <LectureHome uiScale={1} onOpenLecture={handleOpen} />;
}
