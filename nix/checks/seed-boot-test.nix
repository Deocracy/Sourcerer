# Sourcerer substrate — seed boot test (D-12).
#
# Boots the plain-VM variant (nix/substrate/vm-variant.nix) under QEMU and asserts
# it reaches multi-user.target and that the D-12 seed placeholder service answers
# on loopback with the expected body. This is a working miniature of Phase 13's
# real check (the Databasise engine answering on loopback) — the plumbing here is
# proven in the exact shape Phase 13 reuses. It never boots the WSL variant.
{ pkgs, vmModule }:

pkgs.testers.runNixOSTest {
  name = "seed-boot-test";

  nodes.machine = {
    imports = [ vmModule ];

    # curl is a test-driver convenience, not substrate content — added here, not
    # in nix/substrate/core.nix, which should carry only what real users get.
    environment.systemPackages = [ pkgs.curl ];
  };

  testScript = ''
    machine.wait_for_unit("multi-user.target")
    machine.wait_for_unit("seed-placeholder.service")
    machine.wait_for_open_port(8080)

    # Assert the response body, not merely a 200 — this is what makes it a real
    # service-answers check rather than a port-is-listening check.
    response = machine.succeed("curl -sf http://127.0.0.1:8080/")
    assert "sourcerer-substrate-seed-ok" in response, (
        f"unexpected seed-placeholder response body: {response!r}"
    )

    # The substrate is Nix-native by the project's standing rule; check it at
    # boot rather than assume it.
    machine.succeed("nix --version")
  '';
}
