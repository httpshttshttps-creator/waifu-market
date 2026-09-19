import { Component } from "react";

// The boot overlay is decoration. If anything in it ever throws, drop it and
// let the app open instead of letting React unmount the whole tree (which
// left a blank screen).
export default class BootBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("Boot screen failed, skipping it", error);
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
