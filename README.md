# Pijar

Menu render Remotion tanpa mengetik perintah panjang. Taruh file komposisi di folder `src`, jalankan menu, pilih nomor, video jadi.

Pijar adalah proyek Remotion yang dilengkapi tool kecil bernama `tools/menu.mjs`. Tool ini memindai folder `src`, mengenali semua komposisi yang ada, menulis ulang `Root.tsx` secara otomatis, lalu menampilkan menu bernomor. Komposisi yang dipilih akan dicek tipenya dulu memakai TypeScript, dan hanya dirender kalau bersih dari error.

## Cara pakai

1. Taruh file komposisi baru di folder `src`, contohnya `VideoSaya.tsx`.
2. Jalankan menu:
   - Windows: klik dua kali `render.bat`.
   - Terminal: `npm run menu`.
3. Ketik nomor komposisi yang mau dirender, tekan Enter.
4. Hasil render masuk ke folder `out` dengan nama sesuai `OUTPUT_NAME` di file komposisi itu.

## Mulai cepat

```bash
git clone https://github.com/Edzard9/pijar.git
cd pijar
npm install
npm run menu
```

Syarat: Node.js 18 atau lebih baru.

## Aturan file komposisi

Tool mengenali komposisi dari tiga hal:

- Nama komponen yang diekspor harus sama dengan nama file. File `VideoSaya.tsx` harus mengekspor komponen bernama `VideoSaya`.
- Metadata dibaca dari ekspor konstanta di file itu sendiri:

  | Ekspor         | Fungsi                                   | Bawaan kalau tidak ada |
  | -------------- | ---------------------------------------- | ----------------------- |
  | `TOTAL_FRAMES` | Durasi komposisi dalam frame             | 90                      |
  | `FPS`          | Frame per detik                          | 30                      |
  | `WIDTH`, `W`   | Lebar video                              | 1080                    |
  | `HEIGHT`, `H`  | Tinggi video                             | 1920                    |
  | `OUTPUT_NAME`  | Nama file hasil render di folder `out`   | nama file huruf kecil   |

- Aset statis seperti audio dan gambar taruh di folder `public`, panggil memakai `staticFile()` dari Remotion.

Contoh paling kecil ada di `src/Demo.tsx`.

## Yang tidak perlu disentuh

`src/Root.tsx` adalah file hasil generate. Setiap menu dijalankan, isinya ditulis ulang dari hasil pindaian `src`. Jangan edit file ini dengan tangan, perubahanmu akan tertimpa. Versi sebelum generate pertama tersimpan sebagai `src/Root.tsx.bak`.

## Perintah lain

| Perintah          | Fungsi                                          |
| ----------------- | ----------------------------------------------- |
| `npm run menu`    | Buka menu render interaktif                     |
| `npm run gen`     | Tulis ulang `Root.tsx` saja, tanpa render       |
| `npm run studio`  | Buka Remotion Studio                            |
| `npm run render`  | Perintah render bawaan Remotion (manual)        |

## Struktur folder

```
pijar/
  tools/menu.mjs   Tool menu dan generator Root.tsx
  render.bat       Pintasan menu untuk Windows
  src/             File komposisi kamu di sini
  public/          Aset statis (audio, gambar)
  out/             Hasil render
```

## Teknologi

Remotion 4, React 19, TypeScript, dan Three.js lewat `@remotion/three` untuk komposisi 3D.

## Lisensi

MIT, lihat file `LICENSE`.
