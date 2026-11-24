import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LinksService } from '../links/links.service.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';
import { validateContentGuardrails } from './guardrails.util.js';

export interface GeneratedContentOutput {
  product: {
    id: number;
    name: string;
    price: number | null;
    category: string | null;
    platformName: string;
  };
  channel: string;
  angle: string;
  hooks: string[];
  shortScript: string;
  caption: string;
  hashtags: string[];
  guardrailsCheck: {
    passed: boolean;
    warnings: string[];
  };
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly linksService: LinksService,
  ) {}

  async generate(dto: GenerateContentDto): Promise<GeneratedContentOutput> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { platform: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    const channel = dto.channel || 'tiktok';
    const angle = dto.angle || 'problem_solution';
    const targetAudience = dto.targetAudience || 'anak muda dan pekerja kantoran';

    const formattedPrice = product.price
      ? `Rp ${product.price.toLocaleString('id-ID')}`
      : 'harga ramah kantong';

    // Tailored hooks based on product angle
    let hooks: string[] = [];
    if (angle === 'unboxing') {
      hooks = [
        `Akhirnya paket ${product.name} yang lagi viral sampai juga! Yuk kita unboxing bareng.`,
        `Ekspektasi vs Realita: Beli ${product.name} di ${product.platform.name}, beneran sebagus itu?`,
        `Unboxing jujur ${product.name} cuma ${formattedPrice}. Worth it gak ya?`,
      ];
    } else if (angle === 'comparison') {
      hooks = [
        `Daripada beli yang jutaan, mending cek ${product.name} ini deh!`,
        `Perbedaan ${product.name} ini dibanding produk serupa lainnya yang bikin kaget.`,
        `Battle barang viral: kenapa ${product.name} ini paling banyak dicari minggu ini?`,
      ];
    } else if (angle === 'storytelling') {
      hooks = [
        `Awalnya sempat ragu mau beli ${product.name}, tapi setelah seminggu pakai...`,
        `Cerita gimana ${product.name} ini ngebantu banget aktivitasku sehari-hari.`,
        `Gara-gara keracunan review orang, aku checkout ${product.name} dan ternyata beneran ngebantu!`,
      ];
    } else {
      // problem_solution & recommendation
      hooks = [
        `Stop ribet! Ini dia solusi praktis pakai ${product.name}.`,
        `Nyesel banget baru nemu ${product.name} harga ${formattedPrice} sekarang!`,
        `Khusus buat kalian yang butuh ${product.category || 'barang ini'}: tonton video ini sampai habis.`,
      ];
    }

    const selectedHook = hooks[0];

    const shortScript = `[0-3s Hook]
(Visual: Tunjukkan produk close-up)
"${selectedHook}"

[3-12s Masalah / Setup]
(Visual: Peragakan kerepotan sehari-hari sebelum pakai produk)
"Kalian sering ngerasa repot gak sih kalau lagi butuh ${product.category || 'peralatan'} yang praktis tapi kebanyakan di pasaran harganya kemahalan atau kualitasnya kurang?"

[12-22s Solusi & Fitur Utama]
(Visual: Tunjukkan fitur produk beraksi, detail material, dan cara pakai)
"Nah, ${product.name} ini solusinya. Materialnya kokoh, ukurannya pas, dan yang paling aku suka adalah fungsinya beneran praktis buat ${targetAudience}. Harganya cuma sekitar ${formattedPrice}."

[22-30s Call To Action]
(Visual: Tunjuk ke arah bio / keranjang kuning dengan senyum ramah)
"Buat kalian yang mau samaan sebelum kehabisan promo, langsung klik link di bio atau keranjang kuning sekarang ya!"`;

    const caption = `Nyesel banget baru tau ada ${product.name} se-worth it ini! 🤩 Harganya cuma ${formattedPrice} tapi ngebantu banget buat aktivitas harian. Ada yang udah punya juga? Tulis di kolom komentar ya! 👇\n\nLink produk sudah ada di bio / keranjang kuning!`;

    const categoryTag = (product.category || 'rekomendasi')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const hashtags = [
      `#racun${channel.toLowerCase()}`,
      '#spillracun',
      '#rekomendasiproduk',
      `#${categoryTag}`,
      '#affiliatemarketing',
      '#belanjapraktis',
    ];

    // Check Guardrails across the generated output
    const combinedContent = `${hooks.join(' ')} ${shortScript} ${caption}`;
    const guardrailsCheck = validateContentGuardrails(combinedContent);

    return {
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        platformName: product.platform.name,
      },
      channel,
      angle,
      hooks,
      shortScript,
      caption,
      hashtags,
      guardrailsCheck,
    };
  }

  async generateAndSaveDraft(dto: GenerateContentDto) {
    const generated = await this.generate(dto);

    if (!generated.guardrailsCheck.passed) {
      throw new BadRequestException(
        `Guardrail failed: ${generated.guardrailsCheck.warnings.join(', ')}`,
      );
    }

    // MANDATORY GUARD: AI drafts are ALWAYS created in status "draft"
    // Human manual review is strictly required before changing to "published"
    const content = await this.prisma.content.create({
      data: {
        title: `[Draft AI] ${generated.hooks[0]}`,
        channel: generated.channel,
        status: 'draft',
      },
    });

    // Automatically create affiliate link for this product and draft content
    const link = await this.linksService.create({
      productId: dto.productId,
      contentId: content.id,
    });

    return {
      content,
      link,
      generatedDraft: generated,
    };
  }

  async reviewAndPublish(contentId: number) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
    });
    if (!content) {
      throw new NotFoundException(`Content with ID ${contentId} not found`);
    }

    return this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });
  }
}
