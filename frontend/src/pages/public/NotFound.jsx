import { Link } from "react-router-dom";
export default function NotFound() {
  return <section className="section"><div className="container center narrow"><h1 className="big-404">404</h1><h2>Page not found</h2><p className="muted">The page you are looking for doesn't exist or has moved.</p><Link className="btn btn-primary" to="/">Back to admissions</Link></div></section>;
}
