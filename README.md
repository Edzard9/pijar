# Pijar

Menu render Remotion tanpa mengetik perintah panjang. Taruh file komposisi di folder `src`, jalankan menu, pilih nomor, video jadi.

Pijar adalah proyek Remotion yang dilengkapi tool kecil bernama `tools/menu.mjs`. Tool ini memindai folder `src`, mengenali semua komposisi yang ada, menulis ulang `Root.tsx` secara otomatis, lalu menampilkan menu bernomor. Komposisi yang dipilih akan dicek tipenya dulu memakai TypeScript, dan hanya dirender kalau bersih dari error.

## Cara pakai

1. Taruh file komposisi baru di folder `src`, contohnya `VideoSaya.tsx`.
2. Jalankan menu:
   - Windows: klik dua kali `render.bat`.
   - Terminal: `npm run menu`.
3. Ketik nomor komposisi yang mau dirender, tekan Enter. Daftar komposisi terurut dari file yang paling baru diubah.
4. Hasil render masuk ke folder `out` dengan nama sesuai `OUTPUT_NAME` di file komposisi itu. Sesudah render berhasil, menu menampilkan tautan biru yang bisa diklik untuk langsung membuka videonya.
5. Program bertanya `Program selesai? (y/n)`. Jawab `n` untuk kembali ke menu dan render lagi, jawab `y` untuk keluar.

## Menaruh file

Setiap jenis file punya tempatnya sendiri:

- **File komposisi Remotion** taruh di folder `src`, satu video satu file `.tsx`. Nama komponen yang diekspor harus sama dengan nama file, contohnya file `VideoSaya.tsx` mengekspor komponen `VideoSaya`.
- **File suara atau narasi** (WAV, MP3) taruh di folder `public`. Di dalam komposisi, panggil dengan `staticFile("nama-file.wav")`. Nama yang ditulis di kode harus sama persis dengan nama file di `public`, dan pakai nama tanpa spasi, ganti spasi dengan garis bawah, supaya file tidak gagal dimuat saat render.
- **Gambar, font, dan aset lain** juga taruh di folder `public`, cara panggilnya sama memakai `staticFile()`.
- **Subtitle** tidak diolah Pijar secara khusus, subtitle ditangani komposisimu sendiri. Dua cara yang umum: tulis potongan teks langsung di file komposisi lalu tampilkan berdasarkan frame, atau taruh file caption (misalnya `.json` dari hasil transkripsi, atau `.srt`) di folder `public` lalu baca dari komposisi, misalnya dengan bantuan paket `@remotion/captions`.
- **Hasil render** otomatis masuk folder `out`, tidak perlu dibuat manual.

## Mulai cepat

```bash
git clone https://github.com/Edzard9/pijar.git
cd pijar
npm install
npm run menu
```

Syarat: Node.js 18 atau lebih baru.

## Render GPU

Pijar menggambar frame dengan GPU bila tersedia. Di Windows mode yang dipakai adalah `angle` lewat Direct3D, berlaku untuk GPU dedicated NVIDIA dan AMD maupun GPU bawaan Intel dan AMD. Di macOS modenya `angle` lewat Metal, berlaku untuk Mac Intel maupun Apple Silicon (M series). Di Linux modenya `egl`. Sebelum render mulai, menu menampilkan nama GPU yang terdeteksi dan mode yang dipakai, lalu sesudah render selesai ada teks info GPU atau CPU yang akhirnya dipakai, tepat di bawah tautan hasil render.

Yang dipercepat GPU adalah menggambar frame, terutama komposisi WebGL dan 3D. Penggabungan frame menjadi video tetap dikerjakan CPU.

Bila render dengan GPU gagal, misalnya karena driver bermasalah, menu otomatis mencoba ulang sekali dengan `swiftshader`, yaitu render software lewat CPU. Jadi di mesin tanpa GPU yang sehat, render tetap jalan, hanya lebih lambat.

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

- Aset seperti file suara, gambar, dan subtitle taruh di folder `public`, detailnya ada di bagian Menaruh file di atas.

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
  public/          Aset statis: file suara, gambar, font, subtitle
  out/             Hasil render
```

## Teknologi

Remotion 4, React 19, TypeScript, dan Three.js lewat `@remotion/three` untuk komposisi 3D.

## Lisensi

MIT, lihat file `LICENSE`.
