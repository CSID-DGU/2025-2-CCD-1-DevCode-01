import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

const PreClass = () => {
  const { state } = useLocation() as {
    state?: { courseId?: number; courseTitle?: string; docTitle?: string };
  };
  const { docId } = useParams<{ docId: string }>();

  useEffect(() => {
    console.log("📄 docId:", docId);
    console.log("📘 docTitle (state):", state?.docTitle);
    console.log("🏫 courseTitle (state):", state?.courseTitle);
  }, [docId, state]);

  return <p>수업 전 페이지</p>;
};

export default PreClass;
