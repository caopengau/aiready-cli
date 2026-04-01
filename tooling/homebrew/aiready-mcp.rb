# AIReady MCP Server Homebrew Formula
# Install with: brew install aiready-mcp

class AireadyMcp < Formula
  desc "AIReady Model Context Protocol (MCP) Server"
  homepage "https://getaiready.dev"
  url "https://registry.npmjs.org/@aiready/mcp-server/-/mcp-server-0.1.0.tgz"
  sha256 "27bdffd6b88d0f65e3c5871e8d4e13dc56151a64349e78371a496428272aac77"
  license "MIT"
  head "https://github.com/getaiready/aiready-cli.git", branch: "main"

  depends_on "node" => :recommended

  def install
    # Install npm package globally
    system "npm", "install", "-g", "--prefix=#{prefix}", "@aiready/mcp-server@#{version}"
    
    # Create a wrapper script
    bin.mkpath
    (bin/"aiready-mcp").write <<~EOS
      #!/bin/bash
      exec "#{prefix}/bin/aiready-mcp" "$@"
    EOS
    
    # Make wrapper executable
    chmod 0755, bin/"aiready-mcp"
  end

  test do
    # Test that the CLI is working
    assert_match "AIReady", shell_output("#{bin}/aiready-mcp --help", 1)
  end

  def caveats
    <<~EOS
      AIReady MCP Server has been installed!

      Quick Start:
        aiready-mcp

      You can now configure your AI agent (like Claude Desktop or Cursor) to use:
        Command: aiready-mcp

      Documentation:
        https://getaiready.dev/docs

      GitHub:
        https://github.com/getaiready/aiready-cli
    EOS
  end
end
