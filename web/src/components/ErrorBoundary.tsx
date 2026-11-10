import { Component, ReactNode } from "react";
import { Crewmate } from "./Crewmate";

export class ErrorBoundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="empty-state">
        <Crewmate size={100} color="#ef4444" dead />
        <h3>Something went sideways</h3>
        <p className="muted">{this.state.err.message}</p>
        <button className="btn" onClick={() => { this.setState({ err: undefined }); location.assign("/"); }}>Back to base</button>
      </div>
    );
  }
}
