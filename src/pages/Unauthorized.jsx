import { Link } from 'react-router-dom'

const Unauthorized = () => {
	return (
		<div className="auth-wrap">
			<div className="auth-card">
				<h2>Access Denied</h2>
				<p>You are not allowed to view this section.</p>
				<Link className="btn-link" to="/dashboard">Go to dashboard</Link>
			</div>
		</div>
	)
}

export default Unauthorized
