import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateImageFile,
  validateImageDimensions,
  getImageDimensions,
  formatFileSize,
  ImageValidationResult,
  ImageDimensionInfo,
} from "./image-handler";

describe("Image Handler", () => {
  describe("validateImageFile", () => {
    // Test valid files
    it("should accept valid JPEG file", () => {
      const file = new File(["test"], "image.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid PNG file", () => {
      const file = new File(["test"], "image.png", { type: "image/png" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid WebP file", () => {
      const file = new File(["test"], "image.webp", { type: "image/webp" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid GIF file", () => {
      const file = new File(["test"], "image.gif", { type: "image/gif" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    // Test file type validation (MIME type)
    it("should reject unsupported MIME type", () => {
      const file = new File(["test"], "image.bmp", { type: "image/bmp" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File type not supported");
      expect(result.error).toContain("JPEG, PNG, WebP, or GIF");
    });

    it("should reject PDF file", () => {
      const file = new File(["test"], "document.pdf", { type: "application/pdf" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File type not supported");
    });

    // Test file extension validation
    it("should reject file with mismatched extension and MIME type", () => {
      const file = new File(["test"], "image.png", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match MIME type");
    });

    it("should reject file with unsupported extension", () => {
      const file = new File(["test"], "image.bmp", { type: "image/bmp" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File type not supported");
    });

    // Test file size validation
    it("should reject file larger than 5MB", () => {
      const largeBuffer = new ArrayBuffer(6 * 1024 * 1024); // 6MB
      const file = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File size exceeds 5MB limit");
    });

    it("should accept file at exactly 5MB", () => {
      const buffer = new ArrayBuffer(5 * 1024 * 1024); // 5MB
      const file = new File([buffer], "max.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("should include readable file size in error message", () => {
      const largeBuffer = new ArrayBuffer(5.5 * 1024 * 1024); // 5.5MB
      const file = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("MB");
    });

    // Test edge cases
    it("should handle uppercase file extensions", () => {
      const file = new File(["test"], "IMAGE.JPG", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("should handle no file extension gracefully", () => {
      const file = new File(["test"], "image", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
    });

    it("should reject when no file is provided", () => {
      // Create a "no file" scenario by passing undefined file name
      const file = new File(["test"], "", { type: "image/jpeg" });
      const result = validateImageFile(file);
      // File still has content, so MIME type passes
      expect(result.valid).toBe(false); // Fails on extension
    });

    // Test JPEG with .jpeg extension
    it("should accept JPEG with .jpeg extension", () => {
      const file = new File(["test"], "image.jpeg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it("should reject JPEG with .png extension", () => {
      const file = new File(["test"], "image.png", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match MIME type");
    });
  });

  describe("validateImageDimensions", () => {
    const MIN_DIM = 200;
    const MAX_DIM = 4000;

    it("should accept image with valid dimensions", () => {
      const dimensions: ImageDimensionInfo = {
        width: 800,
        height: 600,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept minimum dimension boundary (200x200)", () => {
      const dimensions: ImageDimensionInfo = {
        width: 200,
        height: 200,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(true);
    });

    it("should accept maximum dimension boundary (4000x4000)", () => {
      const dimensions: ImageDimensionInfo = {
        width: 4000,
        height: 4000,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(true);
    });

    it("should reject image smaller than 200x200", () => {
      const dimensions: ImageDimensionInfo = {
        width: 100,
        height: 100,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least");
      expect(result.error).toContain("200x200px");
    });

    it("should reject image with width below minimum", () => {
      const dimensions: ImageDimensionInfo = {
        width: 150,
        height: 600,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least");
    });

    it("should reject image with height below minimum", () => {
      const dimensions: ImageDimensionInfo = {
        width: 600,
        height: 150,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must be at least");
    });

    it("should reject image larger than 4000x4000", () => {
      const dimensions: ImageDimensionInfo = {
        width: 5000,
        height: 5000,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must not exceed");
      expect(result.error).toContain("4000x4000px");
    });

    it("should reject image with width exceeding maximum", () => {
      const dimensions: ImageDimensionInfo = {
        width: 4500,
        height: 1000,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must not exceed");
    });

    it("should reject image with height exceeding maximum", () => {
      const dimensions: ImageDimensionInfo = {
        width: 1000,
        height: 4500,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must not exceed");
    });

    it("should include current dimensions in error message", () => {
      const dimensions: ImageDimensionInfo = {
        width: 100,
        height: 100,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.error).toContain("100x100px");
    });

    it("should accept rectangular images within bounds", () => {
      const dimensions: ImageDimensionInfo = {
        width: 3000,
        height: 1000,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(true);
    });

    it("should accept portrait orientation images", () => {
      const dimensions: ImageDimensionInfo = {
        width: 1000,
        height: 2000,
      };
      const result = validateImageDimensions(dimensions);
      expect(result.valid).toBe(true);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(500)).toBe("500 Bytes");
    });

    it("should format kilobytes correctly", () => {
      expect(formatFileSize(1024)).toContain("KB");
      expect(formatFileSize(1024 * 1.5)).toContain("KB");
    });

    it("should format megabytes correctly", () => {
      expect(formatFileSize(1024 * 1024)).toContain("MB");
      expect(formatFileSize(1024 * 1024 * 2.5)).toContain("MB");
    });

    it("should format 5MB correctly", () => {
      const fiveMB = 5 * 1024 * 1024;
      expect(formatFileSize(fiveMB)).toContain("5");
      expect(formatFileSize(fiveMB)).toContain("MB");
    });

    it("should format 5.5MB correctly", () => {
      const fiveDotFiveMB = 5.5 * 1024 * 1024;
      const formatted = formatFileSize(fiveDotFiveMB);
      expect(formatted).toContain("MB");
      expect(formatted).toMatch(/5\.5?/);
    });

    it("should round to 2 decimal places", () => {
      const bytes = 1024 * 1024 * 1.2345;
      const formatted = formatFileSize(bytes);
      // Should have at most 2 decimal places
      expect(formatted.match(/\d\.\d{0,2}/)).toBeTruthy();
    });
  });

  describe("Property-based tests for validation consistency", () => {
    /**
     * Property: For any valid file, validateImageFile should return valid: true
     * Validates: Requirement 7.1 - image validation
     */
    it("should consistently validate valid image files", () => {
      const validFiles = [
        new File(["test"], "test1.jpg", { type: "image/jpeg" }),
        new File(["test"], "test2.jpeg", { type: "image/jpeg" }),
        new File(["test"], "test3.png", { type: "image/png" }),
        new File(["test"], "test4.webp", { type: "image/webp" }),
        new File(["test"], "test5.gif", { type: "image/gif" }),
      ];

      validFiles.forEach((file) => {
        const result = validateImageFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    /**
     * Property: For any invalid MIME type, validateImageFile should reject with clear message
     * Validates: Requirement 7.1 - file type validation
     */
    it("should reject all invalid MIME types with appropriate error", () => {
      const invalidMimeTypes = [
        "image/bmp",
        "image/tiff",
        "application/pdf",
        "text/plain",
        "video/mp4",
      ];

      invalidMimeTypes.forEach((mimeType) => {
        const file = new File(["test"], "test.jpg", { type: mimeType });
        const result = validateImageFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain("JPEG");
      });
    });

    /**
     * Property: For any file exceeding 5MB, validateImageFile should reject with size message
     * Validates: Requirement 7.1 - file size validation
     */
    it("should reject all files exceeding 5MB size limit", () => {
      const sizesInMB = [5.1, 6, 10, 100];

      sizesInMB.forEach((sizeInMB) => {
        const buffer = new ArrayBuffer(sizeInMB * 1024 * 1024);
        const file = new File([buffer], "test.jpg", { type: "image/jpeg" });
        const result = validateImageFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("exceeds 5MB");
      });
    });

    /**
     * Property: For any dimension outside min/max bounds, validateImageDimensions should reject
     * Validates: Requirement 3.12 - image dimension validation
     */
    it("should consistently reject dimensions outside bounds", () => {
      const invalidDimensions = [
        { width: 100, height: 100 }, // Too small
        { width: 199, height: 500 }, // Too small
        { width: 500, height: 199 }, // Too small
        { width: 5000, height: 1000 }, // Too large
        { width: 1000, height: 5000 }, // Too large
        { width: 5000, height: 5000 }, // Too large
      ];

      invalidDimensions.forEach((dims) => {
        const result = validateImageDimensions(dims);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    /**
     * Property: File size formatting should always produce human-readable output
     * Validates: Requirement 7.2 - readable size display
     */
    it("should format all file sizes into readable format", () => {
      const sizes = [0, 512, 1024, 1024 * 1024, 5 * 1024 * 1024];

      sizes.forEach((size) => {
        const formatted = formatFileSize(size);
        expect(formatted).toMatch(/\d+(\.\d{1,2})?\s+(Bytes|KB|MB)/);
      });
    });
  });

  describe("Error message clarity", () => {
    /**
     * Property: All error messages should clearly indicate what failed
     * Validates: Requirement 3.12 - clear error messages
     */
    it("should provide specific error message for unsupported file type", () => {
      const file = new File(["test"], "image.bmp", { type: "image/bmp" });
      const result = validateImageFile(file);
      expect(result.error).toContain("File type not supported");
      expect(result.error).toContain("JPEG");
    });

    it("should provide specific error message for file size", () => {
      const buffer = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([buffer], "large.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result.error).toContain("File size exceeds 5MB limit");
    });

    it("should provide specific error message for small dimensions", () => {
      const dimensions: ImageDimensionInfo = { width: 100, height: 100 };
      const result = validateImageDimensions(dimensions);
      expect(result.error).toContain("at least");
      expect(result.error).toContain("200x200px");
    });

    it("should provide specific error message for large dimensions", () => {
      const dimensions: ImageDimensionInfo = { width: 5000, height: 5000 };
      const result = validateImageDimensions(dimensions);
      expect(result.error).toContain("not exceed");
      expect(result.error).toContain("4000x4000px");
    });
  });
});
