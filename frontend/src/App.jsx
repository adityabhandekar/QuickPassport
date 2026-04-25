import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import axios from "axios";
import "./App.css";

function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [fileName, setFileName] = useState("");

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [bgColor, setBgColor] = useState("#ffffff");
  const [size, setSize] = useState("35x45");
  const [copies, setCopies] = useState("auto");
  const [outputType, setOutputType] = useState("pdf");

  const [finalPreview, setFinalPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_URL = "http://127.0.0.1:5000";

  const aspectRatio = size === "35x45" ? 35 / 45 : 1;

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setFileName(file.name);
    setImageSrc(URL.createObjectURL(file));
    setFinalPreview(null);
  };

  const createCroppedImage = async () => {
    const imageElement = new Image();
    imageElement.src = imageSrc;

    await new Promise((resolve) => {
      imageElement.onload = resolve;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.drawImage(
      imageElement,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const croppedFile = new File([blob], "quickpassport-cropped.png", {
          type: "image/png",
        });
        resolve(croppedFile);
      }, "image/png");
    });
  };

  const createFormData = async () => {
    const croppedFile = await createCroppedImage();

    const formData = new FormData();
    formData.append("image", croppedFile);
    formData.append("bgColor", bgColor);
    formData.append("size", size);
    formData.append("copies", copies);
    formData.append("outputType", outputType);

    return formData;
  };

  const previewFinalPhoto = async () => {
    if (!imageSrc) {
      alert("Please upload image first");
      return;
    }

    setPreviewLoading(true);

    try {
      const croppedFile = await createCroppedImage();

      const formData = new FormData();
      formData.append("image", croppedFile);
      formData.append("bgColor", bgColor);

      const response = await axios.post(`${API_URL}/preview`, formData, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      setFinalPreview(url);
    } catch (error) {
      alert("Preview failed. Check backend and remove.bg API key.");
      console.log(error);
    }

    setPreviewLoading(false);
  };

  const generateFile = async () => {
    if (!imageSrc) {
      alert("Please upload image first");
      return;
    }

    setLoading(true);

    try {
      const formData = await createFormData();

      const response = await axios.post(`${API_URL}/generate`, formData, {
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        outputType === "pdf"
          ? "quickpassport_sheet.pdf"
          : "quickpassport_sheet.jpg";

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Generation failed. Check backend and remove.bg API key.");
      console.log(error);
    }

    setLoading(false);
  };

  return (
    <div className="page">
      <nav className="navbar">
        <div className="brand">
          <img src="/my.jpg" alt="QuickPassport Logo" className="logo-img" />
          <div>
            <h2>QuickPassport</h2>
            <span>Fast. Easy. Passport Ready.</span>
          </div>
        </div>
      </nav>

      <main className="hero">
        <section className="left-panel">
          <div className="badge">AI Background Removal + A4 PDF Generator</div>

          <h1>Create passport photo sheets in seconds.</h1>

          <p>
            Upload your photo, crop it, choose background color, select passport
            size, and download a print-ready A4 sheet.
          </p>

          <div className="steps">
            <div>
              <b>01</b>
              <span>Upload</span>
            </div>
            <div>
              <b>02</b>
              <span>Crop</span>
            </div>
            <div>
              <b>03</b>
              <span>Preview</span>
            </div>
            <div>
              <b>04</b>
              <span>Download</span>
            </div>
          </div>
        </section>

        <section className="app-card">
          <div className="card-header">
            <h2>Generate Your Photo Sheet</h2>
            <p>No login required. Upload, preview, and download.</p>
          </div>

          <label className="upload-box">
            <input type="file" accept="image/*" onChange={handleImageChange} />
            <div className="upload-icon">📷</div>
            <h3>{fileName || "Upload your photo"}</h3>
            <p>PNG, JPG, JPEG supported</p>
          </label>

          {imageSrc && (
            <>
              <div className="crop-box">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspectRatio}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="control full">
                <label>Zoom</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>
            </>
          )}

          <div className="settings-grid">
            <div className="control">
              <label>Photo Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="35x45">35×45 mm India</option>
                <option value="2x2">2×2 inch US</option>
                <option value="50x50">50×50 mm</option>
              </select>
            </div>

            <div className="control">
              <label>Copies</label>
              <select
                value={copies}
                onChange={(e) => setCopies(e.target.value)}
              >
                <option value="auto">Auto-fill A4</option>
                <option value="8">8 Photos</option>
                <option value="16">16 Photos</option>
              </select>
            </div>

            <div className="control">
              <label>Download Type</label>
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value)}
              >
                <option value="pdf">PDF</option>
                <option value="jpg">JPG Sheet</option>
              </select>
            </div>

            <div className="control">
              <label>Background Color</label>
              <div className="color-row">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="color-picker"
                />

                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="color-input"
                />
              </div>

              <div className="quick-colors">
                <button type="button" onClick={() => setBgColor("#ffffff")}>
                  White
                </button>
                <button type="button" onClick={() => setBgColor("#87ceeb")}>
                  Blue
                </button>
                <button type="button" onClick={() => setBgColor("#ff0000")}>
                  Red
                </button>
              </div>
            </div>
          </div>

          <div className="actions">
            <button
              className="secondary-btn"
              onClick={previewFinalPhoto}
              disabled={previewLoading}
            >
              {previewLoading ? "Creating Preview..." : "Preview Final Photo"}
            </button>

            <button
              className="primary-btn"
              onClick={generateFile}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate & Download"}
            </button>
          </div>

          {finalPreview && (
            <div className="final-preview">
              <h3>Final Preview</h3>
              <p>Background removed and selected color applied.</p>
              <img src={finalPreview} alt="Final Preview" />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;