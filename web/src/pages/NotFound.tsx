import { Link } from "react-router-dom";
import { Crewmate } from "../components/Crewmate";

export default function NotFound() {
  return (
    <div className="empty-state">
      <Crewmate size={100} color="#a855f7" dead />
      <h3>404 — lost in space</h3>
      <p className="muted">That page floated away.</p>
      <Link className="btn" to="/">Take me home</Link>
    </div>
  );
}
