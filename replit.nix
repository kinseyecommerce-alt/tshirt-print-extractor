{ pkgs }: {
  # System packages needed at runtime.
  # vips is the native library behind Sharp (image processing).
  deps = [
    pkgs.nodejs_20
    pkgs.vips
  ];
}
