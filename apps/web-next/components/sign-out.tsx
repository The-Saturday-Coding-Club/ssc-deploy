
import { signOut } from "@/auth"

export default function SignOut() {
    return (
        <form
            action={async () => {
                "use server"
                await signOut()
            }}
        >
            <button
                type="submit"
                className="text-sm text-gray-400 hover:text-white transition-colors"
            >
                Sign Out
            </button>
        </form>
    )
}
