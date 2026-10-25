import ExamRoomPage from '../../../exam/[id]/room/page';

export default function ExamsSlugRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  // انتقال شناسه به کامپوننت مشترک اتاق آزمون
  const forwardedParams = params.then((p) => ({ id: p.slug }));
  return <ExamRoomPage params={forwardedParams} />;
}
