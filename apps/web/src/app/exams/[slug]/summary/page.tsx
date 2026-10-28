import ExamSummaryPage from '../../../exam/[id]/summary/page';

export default function CatalogExamSummaryPage({ params }: { params: Promise<{ slug: string }> }) {
  // ریدایرکت یا مپ پارامتر slug به id جهت استفاده مشترک
  const adaptedParams = params.then((p) => ({ id: p.slug }));
  return <ExamSummaryPage params={adaptedParams} />;
}
