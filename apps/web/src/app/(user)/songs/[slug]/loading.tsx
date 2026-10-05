export default function SongDetailLoading() {
  return (
    <div className="flex h-screen animate-pulse flex-col lg:flex-row">
      <div className="bg-muted border-border h-[40vh] w-full border-b lg:h-full lg:w-[40%] lg:border-r lg:border-b-0" />
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-12 p-12">
        <div className="bg-muted h-10 w-3/4 rounded" />
        <div className="bg-muted h-10 w-1/2 rounded" />
        <div className="bg-muted h-10 w-2/3 rounded" />
        <div className="bg-muted h-10 w-3/4 rounded" />
      </div>
    </div>
  );
}
