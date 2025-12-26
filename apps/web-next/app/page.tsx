
import { auth } from "@/auth"
import SignIn from "@/components/sign-in"
import SignOut from "@/components/sign-out"
import Dashboard from "@/components/dashboard"

export default async function Home() {
    const session = await auth()

    if (!session?.user) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-green-400 mb-4">
                    Cloud Deployer
                </h1>
                <p className="text-gray-400 mb-8 max-w-md">
                    Deploy your Node.js apps to AWS in seconds. Just connect your GitHub repository and we handle the rest.
                </p>
                <div className="bg-[#161b22] border border-[#30363d] p-8 rounded-xl w-full max-w-sm">
                    <SignIn />
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen p-8 max-w-6xl mx-auto">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-green-400">
                        Cloud Deployer
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <img src={session.user.image || ""} className="w-6 h-6 rounded-full" />
                        <p className="text-gray-400 text-sm">Welcome back, {session.user.name}</p>
                    </div>
                </div>
                <SignOut />
            </header>

            <Dashboard
                userId={session.user.id}
                accessToken={session.accessToken}
            />
        </main>
    );
}
