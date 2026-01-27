
import SharedNote from "./SharedNote";

export default async function SharePage({ params, searchParams }: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const modeParam = resolvedSearchParams?.mode;
  const mode =
    modeParam === "collab" || modeParam === "readonly"
      ? modeParam
      : "readonly";

  return <SharedNote id={resolvedParams.id} mode={mode} />;
}
