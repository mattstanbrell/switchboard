import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="mb-4">
          There was an error verifying your authentication code. This could happen if:
        </p>
        <ul className="list-disc text-left mb-6 space-y-2">
          <li>The link you clicked has expired</li>
          <li>The link was already used</li>
          <li>The link was malformed</li>
        </ul>
        <Link
          href="/login"
          className="inline-block bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-500"
        >
          Return to login
        </Link>
      </div>
    </div>
  )
} 