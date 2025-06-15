const GITHUB_LOGIN_URL = 'http://localhost:8000/accounts/github/login/';

export function LoginPage() {
    return (
        <div>
            <h1>Welcome to Helix CME</h1>
            <a href={GITHUB_LOGIN_URL}>
                <button>Login with GitHub</button>
            </a>
        </div>
    );
}