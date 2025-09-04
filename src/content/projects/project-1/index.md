---
title: "Proxyswarm"
description: "Lightweight proxy that allows redirect HTTP(S) traffic through a proxy."
date: "Sep 16 2023"
repoURL: "https://github.com/jorgeajimenezl/proxyswarm"
---

ProxySwarm is a performant, lightweight proxy server that enables redirection of HTTP, HTTPS, and SOCKS5 traffic through upstream proxies or direct connections. It is designed to be:

- Highly performant, leveraging Rust and the Tokio asynchronous runtime
- Flexible in its configuration options
- Capable of handling multiple simultaneous connections
- Configurable with access control rules to allow, deny, or bypass specific traffic

ProxySwarm supports various authentication schemes including Basic and Digest authentication (RFC 2069 and RFC 2617), making it suitable for environments requiring authentication.

## Why ProxySwarm?

Previously in my university, the network requires all HTTP(S) traffic to go through an authenticated proxy. However, many applications do not support proxy authentication natively. ProxySwarm addresses this issue by acting as an intermediary that handles the authentication on behalf of these applications.

## Releases

You can find the latest releases on the [GitHub releases page](https://github.com/jorgeajimenezl/proxyswarm/releases)

## 🏛️ License

MIT