const GITHUB_LOGIN_URL = 'http://localhost:8000/accounts/github/login/';
import { Button } from "../components/ui/button";

export function LoginPage() {
    return (
        <div>
            <h1>Welcome to Helix CME</h1>
            <a href={GITHUB_LOGIN_URL}>
                <button>Login with GitHub</button>
                <Button variant="outline" size="lg">Test shadcn Button</Button>
                <Button variant="default">Primary Accent</Button>
            </a>
        </div>

    );
}