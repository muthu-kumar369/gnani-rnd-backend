import { Template, ITemplate } from './template.schema.js';

export class TemplateService {
    async create(data: Partial<ITemplate>, userId: string): Promise<ITemplate> {
        const template = new Template({
            ...data,
            createdBy: userId,
            isPublic: false // User created templates are private by default
        });
        return await template.save();
    }

    async findAll(userId: string): Promise<ITemplate[]> {
        return await Template.find({
            $or: [
                { isPublic: true },
                { createdBy: userId }
            ]
        }).sort({ createdAt: -1 });
    }

    async findById(id: string, userId: string): Promise<ITemplate | null> {
        return await Template.findOne({
            _id: id,
            $or: [
                { isPublic: true },
                { createdBy: userId }
            ]
        });
    }

    async update(id: string, userId: string, data: Partial<ITemplate>): Promise<ITemplate | null> {
        // Only allow updating own templates
        return await Template.findOneAndUpdate(
            { _id: id, createdBy: userId },
            { $set: data },
            { new: true }
        );
    }

    async delete(id: string, userId: string): Promise<boolean> {
        // Only allow deleting own templates
        const result = await Template.deleteOne({ _id: id, createdBy: userId });
        return result.deletedCount === 1;
    }

    async seedDefaults(): Promise<void> {
        const count = await Template.countDocuments({ isPublic: true });
        if (count > 0) return;

        const defaults = [
            {
                name: 'Code Assistant',
                description: 'Expert in software development, debugging, and architecture.',
                systemPrompt: 'You are an expert software engineer. You write clean, efficient, and well-documented code. You explain your logic clearly and provide examples.',
                icon: 'Code',
                tags: ['coding', 'development', 'technical'],
                isPublic: true,
                createdBy: 'system'
            },
            {
                name: 'Creative Writer',
                description: 'Helps with storytelling, poetry, and creative content.',
                systemPrompt: 'You are a creative writer. You have a way with words and can write in various styles and tones. You are imaginative and engaging.',
                icon: 'PenTool',
                tags: ['writing', 'creative', 'storytelling'],
                isPublic: true,
                createdBy: 'system'
            },
            {
                name: 'Research Assistant',
                description: 'Helps analyze data, summarize papers, and find information.',
                systemPrompt: 'You are a research assistant. You are analytical, objective, and thorough. You can summarize complex information and provide citations where possible.',
                icon: 'Search',
                tags: ['research', 'analysis', 'academic'],
                isPublic: true,
                createdBy: 'system'
            }
        ];

        await Template.insertMany(defaults);
        console.log('Seeded default templates');
    }
}

export const templateService = new TemplateService();
