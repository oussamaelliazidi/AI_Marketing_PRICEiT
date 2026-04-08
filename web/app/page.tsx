export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          Price every job in{" "}
          <span className="text-yellow-400">2 minutes.</span>
        </h1>
        <p className="text-xl text-gray-400">
          PRICEIT is the construction pricing platform that helps contractors
          and large firms win more jobs without leaving money on the table.
        </p>
        <form className="flex flex-col sm:flex-row gap-3 justify-center">
          <input
            type="email"
            placeholder="your@email.com"
            className="px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 w-full sm:w-80"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-yellow-400 text-gray-950 font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
          >
            Join the Beta
          </button>
        </form>
        <p className="text-sm text-gray-600">Free during beta · No credit card required</p>
      </div>
    </main>
  );
}
